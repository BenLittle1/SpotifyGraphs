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
    const nodeColors = {
      genre: '#ff00ff', // Magenta/Pink for genres
      artist: '#00ffff', // Cyan for artists
      track: '#00ff00'  // Green for tracks
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
          if (d.type === 'artist') return 200 * distanceScale;
          return 350 * distanceScale;
        },
        width / 2,
        height / 2
      ).strength(d => d.type === 'genre' ? 0.8 : 0.3));

    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', '#444')
      .attr('stroke-opacity', linkOpacity)
      .attr('stroke-width', d => Math.sqrt(d.value / 20));

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
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
      .attr('fill', d => nodeColors[d.type])
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => nodeColors[d.type])
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
      .style('user-select', 'none');

    // Add hover and click interactions
    node
      .on('mouseenter', function(event, d) {
        setHoveredNode(d);
        const downstream = findDownstreamNodes(d.id);
        setDownstreamNodes(downstream);
        
        // Highlight downstream nodes
        node.classed('highlighted', (n: ForceTreeNode) => downstream.has(n.id))
            .classed('faded', (n: ForceTreeNode) => !downstream.has(n.id));
        
        // Update node opacity
        node.selectAll<SVGCircleElement, ForceTreeNode>('circle')
          .transition()
          .duration(200)
          .attr('fill-opacity', d => downstream.has(d.id) ? 1 : 0.2)
          .attr('r', d => {
            const baseRadius = d.type === 'genre' ? 
              genreSizeScale(d.value) : 
              sizeScale(d.popularity || 50);
            return downstream.has(d.id) ? baseRadius * nodeScale * 1.2 : baseRadius * nodeScale;
          });
        
        // Update label opacity
        node.selectAll<SVGTextElement, ForceTreeNode>('text')
          .transition()
          .duration(200)
          .attr('opacity', d => {
            if (downstream.has(d.id)) return 1;
            return d.type === 'track' ? 0.1 : 0.2;
          });
        
        // Highlight relevant links
        link.transition()
          .duration(200)
          .attr('stroke-opacity', (l: ForceTreeLink) => {
            const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
            const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
            return downstream.has(sourceId) && downstream.has(targetId) ? 0.8 : 0.05;
          })
          .attr('stroke', (l: ForceTreeLink) => {
            const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
            const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
            if (downstream.has(sourceId) && downstream.has(targetId)) {
              const sourceNode = data.nodes.find(n => n.id === sourceId);
              return sourceNode ? nodeColors[sourceNode.type] : '#444';
            }
            return '#444';
          });
      })
      .on('mouseleave', function(event, d) {
        setHoveredNode(null);
        setDownstreamNodes(new Set());
        
        // Reset all nodes
        node.classed('highlighted', false)
            .classed('faded', false);
        
        // Reset node appearance
        node.selectAll<SVGCircleElement, ForceTreeNode>('circle')
          .transition()
          .duration(200)
          .attr('fill-opacity', 0.8)
          .attr('r', d => {
            const baseRadius = d.type === 'genre' ? 
              genreSizeScale(d.value) : 
              sizeScale(d.popularity || 50);
            return baseRadius * nodeScale;
          });
        
        // Reset label opacity
        node.selectAll<SVGTextElement, ForceTreeNode>('text')
          .transition()
          .duration(200)
          .attr('opacity', d => d.type === 'track' ? 0.7 : 1);
        
        // Reset links
        link.transition()
          .duration(200)
          .attr('stroke-opacity', linkOpacity)
          .attr('stroke', '#444');
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        if (d.spotifyUrl) {
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

    (simulation.force('link') as any).links(data.links);

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

    // Update link opacity
    g.selectAll('.link')
      .attr('stroke-opacity', linkOpacity);

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
        return baseRadius * nodeScale;
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
        const sourceNode = data.nodes.find(n => n.id === (d.source.id || d.source));
        const targetNode = data.nodes.find(n => n.id === (d.target.id || d.target));
        if (sourceNode?.type === 'genre' && targetNode?.type === 'artist') return 150 * linkDistance;
        if (sourceNode?.type === 'artist' && targetNode?.type === 'track') return 80 * linkDistance;
        return 100 * linkDistance;
      });
    }

    // Restart simulation with low alpha to apply changes smoothly
    simulation.alpha(0.3).restart();

  }, [chargeStrength, collisionRadius, linkDistance, gravity, nodeScale, linkOpacity, data, width, height]);

  return (
    <div className="relative">
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
              hoveredNode.type === 'artist' ? '#00ffff' : '#00ff00'
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
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00ffff' }}></div>
            <span>Artists</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00ff00' }}></div>
            <span>Tracks</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceTree; 