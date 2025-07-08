'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ForceTreeNode, ForceTreeLink } from '@/app/lib/forceTreeProcessor';

interface ForceTreeProps {
  data: {
    nodes: ForceTreeNode[];
    links: ForceTreeLink[];
  };
  width: number;
  height: number;
  chargeStrength?: number;
  collisionRadius?: number;
  linkDistance?: number;
  gravity?: number;
  nodeScale?: number;
  linkOpacity?: number;
}

const ForceTree: React.FC<ForceTreeProps> = ({ 
  data, 
  width, 
  height, 
  chargeStrength = 1.0, 
  collisionRadius = 1.0, 
  linkDistance = 1.0,
  gravity = 1.0,
  nodeScale = 1.0,
  linkOpacity = 0.4
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<any>(null);
  const simulationRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<ForceTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<ForceTreeNode | null>(null);
  const [downstreamNodes, setDownstreamNodes] = useState<Set<string>>(new Set());
  const [upstreamNodes, setUpstreamNodes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dynamicMode, setDynamicMode] = useState<boolean>(false);
  const [trackClustering, setTrackClustering] = useState<boolean>(false);
  const [linkOpacities, setLinkOpacities] = useState({
    'genre-artist': 0.6,
    'artist-track': 0.8,
    'cluster-artist': 0.4,
    'cluster-track': 0.3,
  });

  // Initialize the visualization only once
  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Function to find all downstream nodes
    const findDownstreamNodes = (nodeId: string): Set<string> => {
      const downstream = new Set<string>([nodeId]);
      const toProcess = [nodeId];
      
      while (toProcess.length > 0) {
        const currentId = toProcess.pop()!;
        data.links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
          
          if (sourceId === currentId && !downstream.has(targetId)) {
            downstream.add(targetId);
            toProcess.push(targetId);
          }
        });
      }
      
      return downstream;
    };

    // Function to find all upstream nodes (parent nodes in hierarchy)
    const findUpstreamNodes = (nodeId: string): Set<string> => {
      const upstream = new Set<string>([nodeId]);
      const toProcess = [nodeId];
      
      while (toProcess.length > 0) {
        const currentId = toProcess.pop()!;
        data.links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
          
          // Find all links where this node is the target (downstream from source)
          if (targetId === currentId && !upstream.has(sourceId)) {
            upstream.add(sourceId);
            toProcess.push(sourceId);
          }
        });
      }
      
      return upstream;
    };

    // Create container with zoom
    const g = svg.append('g');
    gRef.current = g;
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        transformRef.current = event.transform;
      });

    svg.call(zoom);

    // Restore previous transform if it exists
    if (transformRef.current) {
      svg.call(zoom.transform, transformRef.current);
    }

    // Color scales
    const genreColors = d3.scaleOrdinal(d3.schemeSet3);
    const nodeColors: { [key: string]: string } = {
      genre: '#ff00ff', // Magenta/Pink for genres
      artist: '#A855F7', // Dark neon purple for artists
      track: '#0080FF', // Vibrant electric blue for tracks
      cluster: '#FFFFFF' // Invisible clustering nodes
    };

    // Size scales
    const sizeScale = d3.scaleLinear()
      .domain([0, 100])
      .range([5, 15]);

    const genreSizeScale = d3.scaleLinear()
      .domain([0, d3.max(data.nodes.filter(n => n.type === 'genre'), d => d.value) || 1000])
      .range([20, 40]);

    // Create force simulation
    const simulation = d3.forceSimulation<ForceTreeNode>()
      .force('link', d3.forceLink<ForceTreeNode, ForceTreeLink>()
        .id(d => d.id)
        .distance(d => {
          const sourceNode = data.nodes.find(n => n.id === (d.source as any).id || d.source);
          const targetNode = data.nodes.find(n => n.id === (d.target as any).id || d.target);
          if (sourceNode?.type === 'genre' && targetNode?.type === 'artist') return 150 * linkDistance;
          if (sourceNode?.type === 'artist' && targetNode?.type === 'track') return 80 * linkDistance;
          return 100 * linkDistance;
        })
        .strength(0.5))
      .force('charge', d3.forceManyBody<ForceTreeNode>()
        .strength(d => {
          // Clustering nodes have minimal charge to avoid interference
          if (d.type === 'cluster') {
            return -10; // Very weak repulsion
          }
          
          // Adjust charge strength based on total node count and user setting
          const nodeCount = data.nodes.length;
          let scaleFactor = 1;
          if (nodeCount > 2000) scaleFactor = 0.4;
          else if (nodeCount > 1500) scaleFactor = 0.5;
          else if (nodeCount > 1000) scaleFactor = 0.6;
          else if (nodeCount > 800) scaleFactor = 0.7;
          
          if (d.type === 'genre') return -1000 * scaleFactor * chargeStrength;
          if (d.type === 'artist') return -300 * scaleFactor * chargeStrength;
          return -100 * scaleFactor * chargeStrength;
        }))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(gravity))
      .force('collision', d3.forceCollide<ForceTreeNode>()
        .radius(d => {
          // Clustering nodes have minimal collision radius
          if (d.type === 'cluster') {
            return 1; // Very small collision radius
          }
          
          const baseRadius = d.type === 'genre' ? 
            genreSizeScale(d.value) + 10 : 
            sizeScale(d.popularity || 50) + 5;
          return baseRadius * collisionRadius * nodeScale;
        }))
      // Add radial force to create tree-like structure
      .force('radial', d3.forceRadial<ForceTreeNode>(
        d => {
          // Adjust radial distances based on node count
          const nodeCount = data.nodes.length;
          let distanceScale = 1;
          if (nodeCount > 2000) distanceScale = 1.8;
          else if (nodeCount > 1500) distanceScale = 1.6;
          else if (nodeCount > 1000) distanceScale = 1.4;
          else if (nodeCount > 800) distanceScale = 1.3;
          
          if (d.type === 'genre') return 0;
          if (d.type === 'cluster') return 100 * distanceScale; // Between genre and artist
          if (d.type === 'artist') return 200 * distanceScale;
          return 350 * distanceScale;
        },
        width / 2,
        height / 2
      ).strength(d => {
        if (d.type === 'genre') return 0.8;
        if (d.type === 'cluster') return 0.1; // Very weak radial force
        return 0.3;
      }));

    simulationRef.current = simulation;

    // Filter links based on track clustering setting
    const filteredLinks = data.links.filter(link => {
      if (!trackClustering && link.type === 'cluster-track') {
        return false; // Hide cluster-track links when track clustering is disabled
      }
      return true;
    });

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(filteredLinks)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', '#444')
      .attr('stroke-opacity', (d) => {
        const baseOpacity = linkOpacities[d.type as keyof typeof linkOpacities] || linkOpacity;
        return baseOpacity;
      })
      .attr('stroke-width', d => Math.sqrt(d.value / 20));

    // Create node groups (filter out invisible clustering nodes)
    const visibleNodes = data.nodes.filter(node => !node.invisible);
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(visibleNodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .style('pointer-events', 'all')
      .call(d3.drag<SVGGElement, ForceTreeNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => {
        const baseRadius = d.type === 'genre' ? 
          genreSizeScale(d.value) : 
          sizeScale(d.popularity || 50);
        return baseRadius * nodeScale;
      })
      .attr('fill', d => nodeColors[d.type as string] || '#444')
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => nodeColors[d.type as string] || '#444')
      .attr('stroke-width', 2)
      .style('filter', 'url(#glow)');

    // Add labels
    const labels = node.append('text')
      .text(d => d.name)
      .attr('font-size', d => {
        if (d.type === 'genre') return '14px';
        if (d.type === 'artist') return '12px';
        return '10px';
      })
      .attr('dx', d => {
        if (d.type === 'genre') return 0;
        return sizeScale(d.popularity || 50) + 5;
      })
      .attr('dy', d => d.type === 'genre' ? 4 : 3)
      .attr('text-anchor', d => d.type === 'genre' ? 'middle' : 'start')
      .attr('fill', '#fff')
      .attr('opacity', d => d.type === 'track' ? 0.7 : 1)
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .style('font-family', 'system-ui, sans-serif')
      .style('font-weight', '500');

    // Add hover and click interactions with debouncing
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentHoveredId: string | null = null;

    const applyHoverEffect = (d: ForceTreeNode) => {
      if (currentHoveredId === d.id) return; // Prevent redundant updates
      currentHoveredId = d.id;
      
      const downstream = findDownstreamNodes(d.id);
      const upstream = findUpstreamNodes(d.id);
      
      setHoveredNode(d);
      setDownstreamNodes(downstream);
      setUpstreamNodes(upstream);
    };

    const clearHoverEffect = () => {
      currentHoveredId = null;
      setHoveredNode(null);
      setDownstreamNodes(new Set());
      setUpstreamNodes(new Set());
    };

    node
      .on('mouseenter', function(event, d) {
        // Clear any pending reset
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        
        // Apply hover effect immediately
        applyHoverEffect(d);
      })
      .on('mouseleave', function(event, d) {
        // Add small delay to prevent flickering when moving between elements
        hoverTimeout = setTimeout(() => {
          clearHoverEffect();
        }, 150);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        
        // Toggle expansion state
        setExpandedNodes(prev => {
          const newExpanded = new Set(prev);
          if (newExpanded.has(d.id)) {
            newExpanded.delete(d.id);
          } else {
            newExpanded.add(d.id);
          }
          return newExpanded;
        });
        
        // Shift+click opens in Spotify
        if (event.shiftKey && d.spotifyUrl) {
          window.open(d.spotifyUrl, '_blank');
        }
        
        setSelectedNode(d);
      });

    // Define glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Update positions on tick
    simulation.nodes(data.nodes).on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    (simulation.force('link') as any).links(filteredLinks);

    // Drag functions
    function dragstarted(event: any, d: ForceTreeNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: ForceTreeNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: ForceTreeNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data]); // Only depend on data changes

  // Update visual properties when sliders change
  useEffect(() => {
    if (!gRef.current || !simulationRef.current) return;

    const g = gRef.current;
    const simulation = simulationRef.current;

    // Update link opacity - apply hover state for both upstream and downstream
    g.selectAll('.link')
      .attr('stroke-opacity', (l: any) => {
        // Only apply hover effects if we're currently hovering
        if (hoveredNode && (downstreamNodes.size > 0 || upstreamNodes.size > 0)) {
          const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
          
          // Check if this link is part of downstream path
          const isDownstream = downstreamNodes.has(sourceId) && downstreamNodes.has(targetId);
          // Check if this link is part of upstream path
          const isUpstream = upstreamNodes.has(sourceId) && upstreamNodes.has(targetId);
          
          return (isDownstream || isUpstream) ? 0.8 : 0.05;
        }
        return linkOpacity;
      })
      .attr('stroke', (l: any) => {
        // Only apply hover colors if we're currently hovering
        if (hoveredNode && (downstreamNodes.size > 0 || upstreamNodes.size > 0)) {
          const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
          
          // Check if this link is part of downstream or upstream path
          const isDownstream = downstreamNodes.has(sourceId) && downstreamNodes.has(targetId);
          const isUpstream = upstreamNodes.has(sourceId) && upstreamNodes.has(targetId);
          
          if (isDownstream || isUpstream) {
            const sourceNode = data.nodes.find(n => n.id === sourceId);
            const nodeColors: { [key: string]: string } = {
              genre: '#ff00ff',
              artist: '#A855F7',
              track: '#0080FF'
            };
            return sourceNode ? nodeColors[sourceNode.type as string] || '#444' : '#444';
          }
        }
        return '#444';
      });

    // Update node sizes
    const sizeScale = d3.scaleLinear()
      .domain([0, 100])
      .range([5, 15]);

    const genreSizeScale = d3.scaleLinear()
      .domain([0, d3.max(data.nodes.filter(n => n.type === 'genre'), d => d.value) || 1000])
      .range([20, 40]);

    g.selectAll('.node circle')
      .attr('r', (d: any) => {
        const baseRadius = d.type === 'genre' ? 
          genreSizeScale(d.value) : 
          sizeScale(d.popularity || 50);
        
        // Apply dynamic hover sizing if dynamic mode is enabled
        if (dynamicMode && hoveredNode && (downstreamNodes.size > 0 || upstreamNodes.size > 0)) {
          const isRelevant = downstreamNodes.has(d.id) || upstreamNodes.has(d.id);
          return isRelevant ? baseRadius * nodeScale * 1.2 : baseRadius * nodeScale;
        }
        // Keep consistent sizing during hover to prevent node movement (default mode)
        return baseRadius * nodeScale;
      })
      .attr('fill-opacity', (d: any) => {
        // Apply hover opacity for both upstream and downstream
        if (hoveredNode && (downstreamNodes.size > 0 || upstreamNodes.size > 0)) {
          const isRelevant = downstreamNodes.has(d.id) || upstreamNodes.has(d.id);
          return isRelevant ? 1 : 0.2;
        }
        return 0.8;
      })
      .attr('stroke-width', (d: any) => expandedNodes.has(d.id) ? 4 : 2)
      .attr('stroke', (d: any) => {
        if (expandedNodes.has(d.id)) {
          return '#ffffff';
        }
        const nodeColors: { [key: string]: string } = {
          genre: '#ff00ff',
          artist: '#A855F7',
          track: '#0080FF'
        };
        return nodeColors[d.type as string] || '#444';
      });

    // Update text opacity
    g.selectAll('.node text')
      .attr('opacity', (d: any) => {
        // Apply hover opacity for both upstream and downstream
        if (hoveredNode && (downstreamNodes.size > 0 || upstreamNodes.size > 0)) {
          const isRelevant = downstreamNodes.has(d.id) || upstreamNodes.has(d.id);
          if (isRelevant) return 1;
          return d.type === 'track' ? 0.1 : 0.2;
        }
        return d.type === 'track' ? 0.7 : 1;
      });

    // Update forces
    simulation
      .force('charge', d3.forceManyBody<ForceTreeNode>()
        .strength((d: any) => {
          const nodeCount = data.nodes.length;
          let scaleFactor = 1;
          if (nodeCount > 2000) scaleFactor = 0.4;
          else if (nodeCount > 1500) scaleFactor = 0.5;
          else if (nodeCount > 1000) scaleFactor = 0.6;
          else if (nodeCount > 800) scaleFactor = 0.7;
          
          if (d.type === 'genre') return -1000 * scaleFactor * chargeStrength;
          if (d.type === 'artist') return -300 * scaleFactor * chargeStrength;
          return -100 * scaleFactor * chargeStrength;
        }))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(gravity))
      .force('collision', d3.forceCollide<ForceTreeNode>()
        .radius((d: any) => {
          const baseRadius = d.type === 'genre' ? 
            genreSizeScale(d.value) + 10 : 
            sizeScale(d.popularity || 50) + 5;
          return baseRadius * collisionRadius * nodeScale;
        }));

    // Update link distances
    const linkForce = simulation.force('link') as any;
    if (linkForce) {
      linkForce.distance((d: any) => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        const sourceNode = data.nodes.find(n => n.id === sourceId);
        const targetNode = data.nodes.find(n => n.id === targetId);
        
        // If parent is expanded, increase distance to children
        if (expandedNodes.has(sourceId)) {
          return 150; // Fixed expansion distance
        }
        
        // Normal distances
        if (sourceNode?.type === 'genre' && targetNode?.type === 'artist') return 150 * linkDistance;
        if (sourceNode?.type === 'artist' && targetNode?.type === 'track') return 80 * linkDistance;
        return 100 * linkDistance;
      });
    }

    // Restart simulation during hover only if dynamic mode is enabled
    if (dynamicMode && hoveredNode && (downstreamNodes.size > 0 || upstreamNodes.size > 0)) {
      simulation.alpha(0.3).restart();
    }

  }, [chargeStrength, collisionRadius, linkDistance, gravity, nodeScale, linkOpacity, data, width, height, expandedNodes, downstreamNodes, upstreamNodes, hoveredNode, dynamicMode, linkOpacities, trackClustering]);

  // Handle cluster expansion effect
  useEffect(() => {
    if (!simulationRef.current || !gRef.current) return;
    
    const simulation = simulationRef.current;
    const nodes = simulation.nodes();
    
    // Create a map of parent to children
    const parentToChildren = new Map<string, ForceTreeNode[]>();
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      if (!parentToChildren.has(sourceId)) {
        parentToChildren.set(sourceId, []);
      }
      
      const targetNode = nodes.find((n: any) => n.id === targetId);
      if (targetNode) {
        parentToChildren.get(sourceId)!.push(targetNode);
      }
    });
    
    // Apply expansion forces
    nodes.forEach((node: any) => {
      const children = parentToChildren.get(node.id) || [];
      
      if (expandedNodes.has(node.id) && children.length > 0) {
        // Arrange children in a circle around the parent
        const angleStep = (2 * Math.PI) / children.length;
        const expansionRadius = 150; // Distance from parent
        
        children.forEach((child: any, index: number) => {
          const angle = index * angleStep;
          const targetX = node.x + expansionRadius * Math.cos(angle);
          const targetY = node.y + expansionRadius * Math.sin(angle);
          
          // Apply a strong force to move child to target position
          if (!child.fx && !child.fy) { // Only if not being dragged
            const dx = targetX - child.x;
            const dy = targetY - child.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
              const force = 0.1; // Strength of expansion force
              child.vx += (dx / distance) * force * distance;
              child.vy += (dy / distance) * force * distance;
            }
          }
        });
      }
    });
    
    // Update link distances based on expansion
    const linkForce = simulation.force('link') as any;
    if (linkForce) {
      linkForce.distance((d: any) => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        const sourceNode = data.nodes.find(n => n.id === sourceId);
        const targetNode = data.nodes.find(n => n.id === targetId);
        
        // If parent is expanded, increase distance to children
        if (expandedNodes.has(sourceId)) {
          return 150; // Fixed expansion distance
        }
        
        // Normal distances
        if (sourceNode?.type === 'genre' && targetNode?.type === 'artist') return 150 * linkDistance;
        if (sourceNode?.type === 'artist' && targetNode?.type === 'track') return 80 * linkDistance;
        return 100 * linkDistance;
      });
    }
    
    // Restart simulation to apply changes
    simulation.alpha(0.5).restart();
    
  }, [expandedNodes, data, linkDistance]);

  // The hover effects are now handled directly in the main useEffect to prevent conflicts

  return (
    <div className="relative">
      {/* Dynamic Mode Toggle - Left Side */}
      <div className="absolute top-4 left-4 z-20 bg-gray-800 p-3 rounded-lg border border-gray-600">
        <label className="flex items-center space-x-2 text-white text-sm">
          <input
            type="checkbox"
            checked={dynamicMode}
            onChange={(e) => setDynamicMode(e.target.checked)}
            className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
          />
          <span>Dynamic Mode</span>
        </label>
      </div>

      {/* Controls Panel - Right Side */}
      <div className="absolute top-4 right-4 z-20 bg-gray-800 p-3 rounded-lg border border-gray-600 space-y-3">
        {/* Track Clustering Toggle */}
        <label className="flex items-center space-x-2 text-white text-sm">
          <input
            type="checkbox"
            checked={trackClustering}
            onChange={(e) => setTrackClustering(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span>Track Clustering</span>
        </label>
        
        {/* Link Opacity Controls */}
        <div className="space-y-2">
          <div className="text-white text-xs font-semibold">Link Opacity</div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-300 w-20">Genre↔Artist</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={linkOpacities['genre-artist']}
              onChange={(e) => setLinkOpacities(prev => ({...prev, 'genre-artist': parseFloat(e.target.value)}))}
              className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-400 w-8">{linkOpacities['genre-artist']}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-300 w-20">Artist↔Track</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={linkOpacities['artist-track']}
              onChange={(e) => setLinkOpacities(prev => ({...prev, 'artist-track': parseFloat(e.target.value)}))}
              className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-400 w-8">{linkOpacities['artist-track']}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-300 w-20">Cluster↔Artist</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={linkOpacities['cluster-artist']}
              onChange={(e) => setLinkOpacities(prev => ({...prev, 'cluster-artist': parseFloat(e.target.value)}))}
              className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-400 w-8">{linkOpacities['cluster-artist']}</span>
          </div>
          
          {/* Conditionally show Cluster↔Track slider when track clustering is enabled */}
          {trackClustering && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-300 w-20">Cluster↔Track</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={linkOpacities['cluster-track']}
                onChange={(e) => setLinkOpacities(prev => ({...prev, 'cluster-track': parseFloat(e.target.value)}))}
                className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400 w-8">{linkOpacities['cluster-track']}</span>
            </div>
          )}
        </div>
      </div>
      
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ background: '#0a0a0a' }}
      />
      
      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="absolute bg-gray-900 text-white p-2 rounded shadow-lg pointer-events-none z-10"
          style={{
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
            border: `1px solid ${
              hoveredNode.type === 'genre' ? '#ff00ff' :
              hoveredNode.type === 'artist' ? '#A855F7' : '#0080FF'
            }`
          }}
        >
          <div className="font-semibold">{hoveredNode.name}</div>
          <div className="text-sm text-gray-400">
            {hoveredNode.type.charAt(0).toUpperCase() + hoveredNode.type.slice(1)}
          </div>
          {hoveredNode.popularity && (
            <div className="text-sm">Popularity: {hoveredNode.popularity}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {expandedNodes.has(hoveredNode.id) ? 'Click to collapse' : 'Click to expand'}
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-80 p-3 rounded">
        <div className="text-white text-sm space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff00ff' }}></div>
            <span>Genres</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#A855F7' }}></div>
            <span>Artists</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1E40AF' }}></div>
            <span>Tracks</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
            <div>Click: Expand/Collapse</div>
            <div>Shift+Click: Open in Spotify</div>
            <div>Drag: Move nodes</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceTree; 